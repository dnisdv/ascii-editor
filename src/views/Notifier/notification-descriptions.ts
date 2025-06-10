export const CLIPBOARD_COPY_SUCCESS_CODE = 'CLIPBOARD_COPY_SUCCESS_CODE';
export const CLIPBOARD_COPY_ERROR_CODE = 'CLIPBOARD_COPY_ERROR_CODE';
export const CLIPBOARD_COPY_EMPTY_CODE = 'CLIPBOARD_COPY_EMPTY_CODE';

export const NOTIFICATION_CODE_TO_DESCRIPTION_MAP: { [x in string]: string } = {
	[CLIPBOARD_COPY_ERROR_CODE]: 'Copying failed. Please try again',
	[CLIPBOARD_COPY_SUCCESS_CODE]: 'Succesfully copied to clipboard',
	[CLIPBOARD_COPY_EMPTY_CODE]: 'Draw something to copy it'
};
