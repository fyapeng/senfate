export function userFacingRequestError(cause:unknown,fallback:string):string{
  return cause instanceof Error&&/[\u3400-\u9fff]/u.test(cause.message)?cause.message:fallback;
}
