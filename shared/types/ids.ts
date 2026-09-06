/**
 * Identificativi tipizzati. `UserId` e `string` non sono intercambiabili, così
 * passare l'id di un'entità dove ne serve un'altra non compila — l'errore più
 * probabile quando le entità in gioco diventano molte e hanno tutte un `id`.
 *
 * Il marchio vive solo nello spazio dei tipi: a runtime resta una stringa,
 * quindi il JSON che viaggia sul filo non cambia di una virgola.
 */

declare const brand: unique symbol;

export type Branded<TBase, TName extends string> = TBase & { readonly [brand]: TName; };

export type UserId = Branded<string, 'UserId'>;
