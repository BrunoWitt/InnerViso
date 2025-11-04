# backend/hub/get_notices.py
import sys, json, requests
from bs4 import BeautifulSoup

def scrape(url: str, limit: int = 5):
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    
    out = []
    
    for c in soup.select(".tileItem")[:limit]:
        a = c.find("a")
        title = a.get_text(strip=True) if a else ""
        link = a["href"] if a and a.has_attr("href") else ""
        desc_el = c.find(class_="description")
        data_el = c.find(class_="documentByLine")
        desc = desc_el.get_text(strip=True) if desc_el else ""
        data = data_el.get_text(strip=True) if data_el else ""
        out.append({"title": title, "link": link, "desc": desc, "data": data})
    return out

def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: get_notices.py <saida_json>", file=sys.stderr)
        return 2
    
    out_path = sys.argv[1]
    
    noticias_ex = scrape("https://www.gov.br/siscomex/pt-br/noticias/noticias-siscomex-exportacao")
    noticias_im = scrape("https://www.gov.br/siscomex/pt-br/noticias/noticias-siscomex-importacao")
    noticias_si = scrape("https://www.gov.br/siscomex/pt-br/noticias/noticias-siscomex-sistemas")
    
    payload = {
        "noticias_ex": noticias_ex,
        "noticias_im": noticias_im,
        "noticias_si": noticias_si,
    }
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        
    return 0
    
if __name__ == "__main__":
    raise SystemExit(main())
