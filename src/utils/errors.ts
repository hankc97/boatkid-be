import { isDefined } from './assert';
import { repr } from './misc';

export const getErrorMessage = (e: unknown): string => {
  if ((e as { response?: { body: unknown } }).response?.body) {
    return repr((e as { response: { body: unknown } }).response.body);
  }
  if (e instanceof Error) {
    if (isDefined(e.message)) {
      return e.message;
    }
    // some external APIs conform to this, so checking to see if it is an instance of that
    if ((e as { statusText?: string }).statusText) {
      return (e as unknown as { statusText: string }).statusText;
    }
  }
  return repr(e);
};
