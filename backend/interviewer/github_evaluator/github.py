import httpx

API = "https://api.github.com"
async def request(token, path, params=None):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(API + path, params=params, headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"})
        r.raise_for_status(); return r.json()

async def exchange(code, client_id, client_secret):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("https://github.com/login/oauth/access_token", data={"client_id":client_id,"client_secret":client_secret,"code":code}, headers={"Accept":"application/json"})
        r.raise_for_status(); data=r.json()
        if "access_token" not in data: raise ValueError("GitHub OAuth exchange failed")
        return data["access_token"]
