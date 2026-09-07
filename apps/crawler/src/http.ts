import iconv from "iconv-lite";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/**
 * 유웨이 계열 사이트는 euc-kr로 서빙된다. fetch 후 바이트 그대로 받아 직접 디코딩한다.
 */
export async function fetchEucKr(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return iconv.decode(buf, "euc-kr");
}
