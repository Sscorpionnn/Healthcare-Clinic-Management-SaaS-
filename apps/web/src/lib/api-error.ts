// RFC 9457 problem+json shape returned by the API on every error — see
// docs/api-contract.md "Error shape".
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }
}

export async function parseErrorResponse(
  response: Response,
): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ProblemDetails>;
    return new ApiError({
      type: body.type ?? "about:blank",
      title: body.title ?? response.statusText,
      status: body.status ?? response.status,
      detail: body.detail,
      instance: body.instance,
    });
  } catch {
    return new ApiError({
      type: "about:blank",
      title: response.statusText,
      status: response.status,
    });
  }
}
