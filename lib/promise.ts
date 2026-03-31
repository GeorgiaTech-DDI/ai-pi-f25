/**
 * A standard wrapper for Server Action responses.
 * T is the type of data returned on success.
 */
export type ActionResponse<T = void> =
  | { isError: false; data?: T }
  | { isError: true; message: string };

// If you specifically want it wrapped in a Promise for your function signatures:
export type ActionPromise<T = void> = Promise<ActionResponse<T>>;
