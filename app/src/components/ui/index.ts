/**
 * Design system do Agenda Psi. Toda tela importa daqui, nunca dos arquivos
 * soltos — assim uma mudança de medida ou de cor acontece num lugar só.
 *
 * Implementa: seção 16 do spec e a seção "Componentes-chave" do handoff.
 */
export { Text, type TextVariant } from './text';
export { Icon, type IconName } from './icon';
export { IconButton } from './icon-button';
export { TextLink } from './text-link';
export { ListGroup, RowSeparator } from './list-group';
export { ActionRow, NavigationRow, ValueRow, FormRow, ToggleRow, MultilineRow } from './rows';
export { FilledButton } from './filled-button';
export { EmptyState } from './empty-state';
export { ErrorState } from './error-state';
export { SkeletonBar, SkeletonRow, SkeletonGroup, skeletonGap } from './skeleton';
export { Screen, ScreenFooter } from './screen';
export { StatCard } from './stat-card';
export { SearchField } from './search-field';
export { SwipeToDelete } from './swipe-to-delete';
export { SegmentedControl, SegmentedGroupContent, type SegmentoOpcao } from './segmented-control';
export { DateRow, hojeNoFormatoDoBanco } from './date-row';
export { PickerRow, type OpcaoDoSeletor } from './picker-row';
export { TimeRow } from './time-row';
export { MarkdownText } from './markdown-text';
