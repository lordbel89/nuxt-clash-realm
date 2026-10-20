import { CreateTournamentInput } from '#shared/schemas/tournament';
import * as v from 'valibot';

/**
 * I campi che `TournamentForm` modifica: le regole sono quelle della creazione, senza
 * `organizationId`, che la pagina di creazione sceglie a parte e la modifica non manda.
 */
export const TournamentFormSchema = v.omit(CreateTournamentInput, ['organizationId']);

/** Lo stato del form, prima della validazione */
export type TournamentFormState = v.InferInput<typeof TournamentFormSchema>;

/** Ciò che il form emette: validato e ripulito (testi vuoti → null, fuso di default) */
export type TournamentFormData = v.InferOutput<typeof TournamentFormSchema>;
