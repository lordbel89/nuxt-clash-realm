"""Adattatore GitHub per le skill review-pr e address-pr. Solo stdlib + `gh`.

  python github.py meta    <PR>
  python github.py threads <PR>
  python github.py post    <PR> <payload.json>
  python github.py reply   <PR> <threadId> <body.md>
  python github.py status  <PR> <threadId> <resolved|unresolved>

<PR> = numero o URL della PR. Senza URL, il repo e quello del remote `origin` (lo risolve `gh`).
Output: JSON UTF-8 su stdout, nel formato normalizzato descritto nei SKILL.md delle due skill.
Exit 2 = prerequisito mancante (messaggio su stderr, da girare all'utente). Exit 1 = errore.

Tutto passa da `gh api`, con le richieste su stdin e non come argomenti: cosi gli accenti
arrivano intatti anche su Windows.
"""

import json
import re
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def stop(msg):
    print(f"STOP: {msg}", file=sys.stderr)
    sys.exit(2)


def fail(msg):
    print(f"ERRORE: {msg}", file=sys.stderr)
    sys.exit(1)


def gh(args, stdin=None):
    if shutil.which("gh") is None:
        stop("la CLI `gh` non e installata. Installala con `winget install GitHub.cli`, poi `gh auth login`.")
    r = subprocess.run(
        ["gh", *args],
        input=json.dumps(stdin) if stdin is not None else None,
        capture_output=True,
        encoding="utf-8",
    )
    if r.returncode != 0:
        err = r.stderr.strip()
        if "auth login" in err or "HTTP 401" in err or "not logged" in err.lower():
            stop(f"`gh` non e autenticato ({err}). Lancia `gh auth login`.")
        fail(f"gh {' '.join(args[:3])}: {err}")
    return json.loads(r.stdout) if r.stdout.strip() else None


def graphql(query, **variables):
    res = gh(["api", "graphql", "--input", "-"], {"query": query, "variables": variables})
    if res.get("errors"):
        fail(json.dumps(res["errors"], ensure_ascii=False))
    return res["data"]


FIELDS = "number,url,title,body,state,isDraft,author,headRefName,baseRefName,headRefOid,baseRefOid,latestReviews,reviewRequests"


def pr_view(pr):
    data = gh(["pr", "view", pr, "--json", FIELDS])
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", data["url"])
    return data, m.group(1), m.group(2), int(m.group(3))


def meta(pr):
    d, *_ = pr_view(pr)
    reviewers = [{"name": r["author"]["login"], "vote": r["state"]} for r in d["latestReviews"]]
    seen = {r["name"] for r in reviewers}
    for r in d["reviewRequests"]:
        name = r.get("login") or r.get("name") or r.get("slug")
        if name and name not in seen:
            reviewers.append({"name": name, "vote": "REQUESTED"})
    return {
        "id": d["number"],
        "url": d["url"],
        "title": d["title"],
        "description": d["body"],
        "status": d["state"].lower(),
        "isDraft": d["isDraft"],
        "author": d["author"]["login"],
        "source": d["headRefName"],
        "target": d["baseRefName"],
        "sourceCommit": d["headRefOid"],
        "targetCommit": d["baseRefOid"],
        "reviewers": reviewers,
    }


THREADS_QUERY = """
query($owner: String!, $repo: String!, $n: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $n) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated path diffSide line startLine originalLine originalStartLine
          comments(first: 100) {
            nodes { databaseId author { login __typename } createdAt body }
          }
        }
      }
      comments(first: 100) {
        nodes { id databaseId author { login __typename } createdAt body }
      }
      reviews(first: 100) {
        nodes { id databaseId state author { login __typename } submittedAt body }
      }
    }
  }
}
"""


def author(node):
    return (node.get("author") or {}).get("login", "ghost")


def is_bot(node):
    return (node.get("author") or {}).get("__typename") == "Bot"


def threads(pr):
    _, owner, repo, n = pr_view(pr)
    out, after, first_page = [], None, None
    while True:
        p = graphql(THREADS_QUERY, owner=owner, repo=repo, n=n, after=after)["repository"]["pullRequest"]
        first_page = first_page or p
        for t in p["reviewThreads"]["nodes"]:
            line = t["line"] or t["originalLine"]
            start = t["startLine"] or t["originalStartLine"]
            out.append({
                "id": t["id"],
                "status": "closed" if t["isResolved"] else "open",
                "rawStatus": ("resolved" if t["isResolved"] else "unresolved") + (",outdated" if t["isOutdated"] else ""),
                "file": t["path"],
                "side": (t["diffSide"] or "RIGHT").lower(),
                "line": start or line,
                "lineEnd": line if start else None,
                "comments": [
                    {"id": c["databaseId"], "author": author(c), "date": c["createdAt"], "content": c["body"]}
                    for c in t["comments"]["nodes"]
                ],
            })
        page = p["reviewThreads"]["pageInfo"]
        if not page["hasNextPage"]:
            break
        after = page["endCursor"]

    # Commenti di conversazione e corpi delle review: su GitHub non sono thread e non si
    # risolvono. Escono come thread di un commento, aperti, con rawStatus che dice cosa sono.
    # I bot (deploy Cloudflare, CI) sono i "thread di sistema" e restano fuori.
    loose = [(c, "comment", c["createdAt"]) for c in first_page["comments"]["nodes"]]
    loose += [(r, f"review:{r['state']}", r["submittedAt"]) for r in first_page["reviews"]["nodes"] if r["body"].strip()]
    for node, raw, date in loose:
        if is_bot(node):
            continue
        out.append({
            "id": node["id"],
            "status": "open",
            "rawStatus": raw,
            "file": None,
            "side": None,
            "line": None,
            "lineEnd": None,
            "comments": [{"id": node["databaseId"], "author": author(node), "date": date, "content": node["body"]}],
        })
    return out


def post(pr, payload_path):
    with open(payload_path, encoding="utf-8") as f:
        p = json.load(f)
    d, owner, repo, n = pr_view(pr)
    if not p.get("file"):
        c = gh(["api", "-X", "POST", f"repos/{owner}/{repo}/issues/{n}/comments", "--input", "-"], {"body": p["body"]})
        return {"id": c["id"], "file": None, "line": None, "url": c["html_url"]}
    side = (p.get("side") or "right").upper()
    # GitHub vuole `line` = ultima riga del range e `start_line` = la prima.
    req = {"body": p["body"], "commit_id": d["headRefOid"], "path": p["file"], "side": side, "line": p["line"]}
    if p.get("lineEnd") and p["lineEnd"] != p["line"]:
        req.update(start_line=p["line"], start_side=side, line=p["lineEnd"])
    c = gh(["api", "-X", "POST", f"repos/{owner}/{repo}/pulls/{n}/comments", "--input", "-"], req)
    return {"id": c["id"], "file": c["path"], "line": c.get("start_line") or c["line"], "url": c["html_url"]}


def reply(pr, thread_id, body_path):
    with open(body_path, encoding="utf-8") as f:
        body = f.read()
    if thread_id.startswith("PRRT_"):
        c = graphql(
            """mutation($id: ID!, $body: String!) {
                 addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) {
                   comment { databaseId url }
                 }
               }""",
            id=thread_id, body=body,
        )["addPullRequestReviewThreadReply"]["comment"]
        return {"threadId": thread_id, "commentId": c["databaseId"], "url": c["url"]}
    # Commento di conversazione o corpo di review: non c'e un thread in cui rispondere.
    _, owner, repo, n = pr_view(pr)
    c = gh(["api", "-X", "POST", f"repos/{owner}/{repo}/issues/{n}/comments", "--input", "-"], {"body": body})
    return {"threadId": thread_id, "commentId": c["id"], "url": c["html_url"],
            "note": "nessun thread su GitHub per questo commento: risposta pubblicata come commento nuovo della PR"}


def status(_pr, thread_id, value):
    if not thread_id.startswith("PRRT_"):
        fail(f"{thread_id} non e un thread di review: su GitHub solo quelli hanno uno stato.")
    if value not in ("resolved", "unresolved"):
        fail(f"stato '{value}' non valido: usa resolved o unresolved.")
    op = "resolveReviewThread" if value == "resolved" else "unresolveReviewThread"
    t = graphql(
        f"mutation($id: ID!) {{ {op}(input: {{threadId: $id}}) {{ thread {{ id isResolved }} }} }}",
        id=thread_id,
    )[op]["thread"]
    return {"threadId": t["id"], "rawStatus": "resolved" if t["isResolved"] else "unresolved"}


COMMANDS = {"meta": (meta, 1), "threads": (threads, 1), "post": (post, 2), "reply": (reply, 3), "status": (status, 3)}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS or len(sys.argv) - 2 != COMMANDS[sys.argv[1]][1]:
        fail(__doc__)
    fn, _ = COMMANDS[sys.argv[1]]
    print(json.dumps(fn(*sys.argv[2:]), ensure_ascii=False, indent=2))
