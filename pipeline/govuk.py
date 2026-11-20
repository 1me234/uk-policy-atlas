"""Helpers for GOV.UK content API: list a page's attachments and download them."""
import json, sys, urllib.request, os, hashlib
UA = {"User-Agent": "uk-policy-atlas/0.1 (open data research)"}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
def content(path):
    return json.loads(get("https://www.gov.uk/api/content" + path))
def attachments(path):
    c = content(path)
    out = []
    for a in c.get("details", {}).get("attachments", []) or []:
        out.append({"title": a.get("title"), "url": a.get("url"), "type": a.get("content_type")})
    # collections: list linked documents
    for d in c.get("links", {}).get("documents", []) or []:
        out.append({"title": d.get("title"), "url": "https://www.gov.uk" + d.get("base_path", ""), "type": "page"})
    return c, out
def download(url, dest_dir="raw"):
    os.makedirs(dest_dir, exist_ok=True)
    name = os.path.join(dest_dir, url.rsplit("/", 1)[-1])
    if not os.path.exists(name):
        open(name, "wb").write(get(url))
    return name
if __name__ == "__main__":
    c, a = attachments(sys.argv[1])
    print(c.get("title"), c.get("public_updated_at"))
    for x in a: print(x["type"], "|", x["title"], "|", x["url"])
