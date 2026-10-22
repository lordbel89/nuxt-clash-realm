/**
 * Paginazione degli elenchi `Paginated<T>`: la pagina corrente diventa il `limit`/`offset` delle
 * API (`query`, da passare a `useFetch`) e torna a `UPagination` già pronta (`paginationProps`).
 *
 * `setTotal` riceve il `total` della risposta. Se la pagina corrente non esiste più (cancellato
 * l'ultimo elemento dell'ultima pagina) si torna all'ultima, e `useFetch` rilegge da solo.
 *
 *     const { query, setTotal, paginationProps } = usePagination();
 *     const { data } = await useFetch('/api/organizations', { query });
 *     watch(() => data.value?.total, setTotal, { immediate: true });
 */
export function usePagination(itemsPerPage = 25) {
  const page = ref(1);
  const total = ref(0);

  const query = computed(() => ({ limit: itemsPerPage, offset: (page.value - 1) * itemsPerPage }));

  // `undefined` è una risposta mancante (errore, caricamento): la pagina resta dov'è
  function setTotal(value: number | undefined) {
    if (value === undefined) return;
    total.value = value;
    page.value = Math.min(page.value, Math.max(1, Math.ceil(value / itemsPerPage)));
  }

  const paginationProps = computed(() => ({
    'page': page.value,
    'total': total.value,
    itemsPerPage,
    'onUpdate:page': (value: number) => {
      page.value = value;
    },
  }));

  // Con una pagina sola la paginazione è solo rumore
  const showPagination = computed(() => total.value > itemsPerPage);

  return { page, query, setTotal, paginationProps, showPagination };
}
