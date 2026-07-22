const FIGMA_API = "https://api.figma.com/v1";

const variablesUrl = (fileKey: string): string => `${FIGMA_API}/files/${encodeURIComponent(fileKey)}/variables/local`;

async function parseResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("Figma API 응답을 JSON으로 파싱할 수 없습니다.");
  }
}

function responseError(status: number): Error {
  if (status === 403) return new Error("Figma Variables API 접근이 거부되었습니다. Figma plan, 해당 file 접근 권한, token scope(file_variables:read)를 확인해 주세요.");
  if (status === 429) return new Error("Figma API rate limit에 도달했습니다. 잠시 후 다시 실행해 주세요.");
  return new Error(`Figma API 요청에 실패했습니다. (status ${status})`);
}

export async function fetchFigmaVariables(fileKey: string, token: string): Promise<unknown> {
  // Figma가 Variables endpoint를 변경하면 이 파일만 수정한다.
  const response = await fetch(variablesUrl(fileKey), {
    headers: { "X-Figma-Token": token }
  });
  if (response.ok) return parseResponse(response);
  throw responseError(response.status);
}
