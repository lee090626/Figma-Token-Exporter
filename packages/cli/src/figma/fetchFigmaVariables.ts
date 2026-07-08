const FIGMA_API = "https://api.figma.com/v1";

export async function fetchFigmaVariables(fileKey: string, token: string): Promise<unknown> {
  // Figma가 Variables endpoint를 변경하면 이 파일만 수정한다.
  const response = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/variables/local`, {
    headers: { "X-Figma-Token": token }
  });
  if (response.ok) {
    try {
      return await response.json();
    } catch {
      throw new Error("Figma API 응답을 JSON으로 파싱할 수 없습니다.");
    }
  }
  if (response.status === 403) throw new Error("Figma Variables API 접근이 거부되었습니다. Figma plan, 해당 file 접근 권한, token scope(file_variables:read)를 확인해 주세요.");
  if (response.status === 429) throw new Error("Figma API rate limit에 도달했습니다. 잠시 후 다시 실행해 주세요.");
  throw new Error(`Figma API 요청에 실패했습니다. (status ${response.status})`);
}
