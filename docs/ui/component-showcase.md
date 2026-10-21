# Showcase dei componenti

La pagina `/dev/components` ([app/pages/dev/components.vue](../../app/pages/dev/components.vue)) serve a
provare i componenti dell'app in isolamento. Ogni voce dell'accordion contiene una
`DevComponentShowcaseSection`: a sinistra la `DevPropsCard` con un controllo per ogni prop, a destra
il componente renderizzato con i valori impostati. Cambi una prop nella card e il componente si
aggiorna subito.

| File | Ruolo |
|---|---|
| `app/pages/dev/components.vue` | Elenco dei componenti mostrati (`items`) |
| `app/components/dev/ComponentShowcaseSection.vue` | Legge le prop del componente, tiene i valori, renderizza il componente |
| `app/components/dev/PropsCard.vue` | Disegna un controllo per prop e restituisce i valori con `v-model` |
| `app/types/components.ts` | Tipo `PropControl` |

## Aggiungere un componente

Una voce in `items`:

```ts
import { FormDatePicker, RoundTimer } from '#components';

const items = [
  {
    label: 'Round Timer',
    component: RoundTimer,
    initial: { huge: true, endsAt: '2026-10-22T00:00:00.000Z' },
    overrides: { endsAt: 'datetime' },
  },
];
```

- `component`: il componente, importato da `#components` (stessi nomi dell'auto-import:
  `app/components/form/DatePicker.vue` → `FormDatePicker`).
- `initial` (facoltativo): i valori di partenza, v-model compreso (`modelValue`). Una prop assente
  parte da `undefined`. Vengono copiati una volta sola: cambiarli dopo il montaggio non reimposta la card.
- `overrides` (facoltativo): il controllo da usare per una prop, al posto di quello dedotto.

## Da dove vengono le prop

Nessuno schema da scrivere: lo showcase legge le `props` runtime che Vue genera da `defineProps`.
Per `RoundTimer`, `defineProps<{ endsAt?: string; huge?: boolean }>()` diventa
`{ endsAt: { type: String }, huge: { type: Boolean } }`, e ogni tipo diventa un controllo:

| Tipo runtime | Controllo |
|---|---|
| `Boolean` | `USwitch` |
| `String` | `UInput` |
| `Number` | `UInputNumber` |
| `Date` | `FormDatePicker` |
| altro (oggetti, array, nessun tipo) | scritta "Tipo non gestito": il valore resta quello di `initial` |

Con più tipi (`[String, Number]`) vince il primo riconosciuto. Le prop `*Modifiers` generate da
`defineModel` sono nascoste.

## Override

Il tipo runtime dice solo il tipo base. Quando non basta, `overrides` sceglie il controllo:

| Valore | Controllo | Quando serve |
|---|---|---|
| `'boolean'`, `'string'`, `'number'`, `'date'` | come sopra | la prop non ha tipo runtime (vedi v-model) |
| `'datetime'` | `UInput type="datetime-local"` | una data ISO passata come stringa, es. `endsAt` |
| `['sm', 'md', 'lg']` | `USelect` con quelle voci | una union di letterali, che a runtime è solo `String` |

`'datetime'` lavora in **UTC** (il campo lo indica): legge e scrive stringhe ISO complete
(`2026-10-22T00:00:00.000Z`). L'ora locale darebbe valori diversi fra server e client e un warning di
idratazione.

## v-model

Un `defineModel` diventa la prop `modelValue` (o `x` per `defineModel('x')`) più l'evento
`update:modelValue`. Lo showcase ascolta ogni evento `update:*` emesso dal componente e riporta il
valore nella card, quindi il legame va nei due sensi: scegli una data nel `FormDatePicker` a destra e
la vedi nella card a sinistra.

**`defineModel` non porta il tipo a runtime** (Vue genera `modelValue: { type: null }`), quindi la sua
prop finisce sempre in "Tipo non gestito" e va dichiarata in `overrides`:

```ts
{
  label: 'DatePicker',
  component: FormDatePicker,
  initial: { modelValue: new Date() },
  overrides: { modelValue: 'date' },
}
```

## Limiti

- **Solo in sviluppo.** Nella build di produzione il compilatore di Vue toglie dalle prop i tipi diversi
  da `Boolean`: stringhe, numeri e date diventano "Tipo non gestito". Gli `overrides` continuano a
  funzionare.
- **Oggetti e array non si modificano.** Un DTO passato come prop (es. il torneo di `TournamentCard`) si
  dà con `initial` e resta fisso. Un editor JSON nella card arriverà col primo componente che ne ha bisogno.
- **Slot non gestiti.** Lo showcase passa solo prop e listener `update:*`: un componente che vive di slot
  mostra solo il contenuto di default.
