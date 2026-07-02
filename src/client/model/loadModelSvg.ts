export async function loadModelSvg(svgPath: string): Promise<string> {
  const response = await fetch(svgPath)
  if (!response.ok) {
    throw new Error(`loadModelSvg: failed to load ${svgPath} (${response.status})`)
  }
  return response.text()
}
