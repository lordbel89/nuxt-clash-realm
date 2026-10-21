// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type USelectItem<T = any> = {
  label: string;
  value: T;
};
/** Controllo della PropsCard per una prop; un array di stringhe diventa una select */
export type PropControl = 'boolean' | 'string' | 'number' | 'date' | 'datetime' | readonly string[];
