import { AssertionError } from "assert";
import { repr } from "./misc";

export type ClassConstructor<T> = {
  new (...args: any[]): T;
};

/**
 * Asserts that an object is defined
 * @param val
 * @param options message: override entire message; name: inject just a name in standard message; errorClass: custom error
 */
export function assertIsDefined<T, E extends Error>(
  val: T,
  options?: {
    message?: string;
    name?: string;
    errorClass?: ClassConstructor<E>;
  }
): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    const errorClass = options?.errorClass ?? AssertionError;
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new errorClass({
      message:
        options?.message ??
        `Expected '${
          options?.name || "val"
        }' to be defined, but received ${repr(val)}`,
    });
  }
}

export const isNullOrUndefined = <T>(value?: T | null): boolean =>
  value === undefined || value === null;
export const isDefined = <T>(
  value: T | null | undefined
): value is NonNullable<T> => !isNullOrUndefined(value);
