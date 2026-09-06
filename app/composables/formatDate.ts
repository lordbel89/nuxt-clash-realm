export const formatDate = (date?: Date): string => {
  if (!date) {
    return '';
  }
  const { locale } = useI18n();
  return date.toLocaleDateString(locale.value);
};
