import http.cookiejar, json, os, pathlib, re, shutil, subprocess, tempfile, time, urllib.request
home=pathlib.Path(os.environ["DSH_HOME"])
version=os.environ.get("PLUGIN_VERSION","0.4.24")
base="http://127.0.0.1:43917"
def boot(check_saved=False):
    with tempfile.TemporaryFile() as log:
        p=subprocess.Popen([shutil.which("dsh"),"--profile","web","--host","127.0.0.1","--port","43917","--no-open"],stdout=log,stderr=log)
        try:
            client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            for _ in range(90):
                time.sleep(1);log.seek(0);lines=log.read().decode(errors="replace")
                m=re.search(r"http://127\.0\.0\.1:43917/\?token=[\w.=-]+",lines)
                if m:
                    client.open(m[0],timeout=10).close()
                    break
                if p.poll() is not None: raise RuntimeError("Official host exited before authentication")
            else: raise RuntimeError("Official host boot timed out")
            def get(path):
                with client.open(base+path,timeout=15) as r:return json.load(r)
            status=get("/api/prompt-coach/v4/status")
            assert status.get("ok") and status.get("version")==version
            library=get("/api/prompt-coach/v4/library")
            assert library["ok"] and library["state"] in ["ready","missing"]
            if check_saved:
                assert "acceptance" in library["value"]["favorites"]
            else:
                body={"expectedRevision":library["value"]["revision"],"op":{"kind":"favorite","id":"acceptance","enabled":True}}
                req=urllib.request.Request(base+"/api/prompt-coach/v4/library/write",data=json.dumps(body).encode(),headers={"content-type":"application/json","Origin":base})
                with client.open(req,timeout=15) as r:written=json.load(r)
                assert written["ok"] and "acceptance" in written["value"]["favorites"]
                assert "acceptance" in get("/api/prompt-coach/v4/library")["value"]["favorites"]
            print(json.dumps({"plugin":version,"officialHost":os.environ["HOST_RC"],"authenticated":True,"libraryWrite":not check_saved,"restartPersistence":check_saved}))
            if os.environ.get("BROWSER")=="1" and not check_saved:
                from playwright.sync_api import sync_playwright
                with sync_playwright() as pw:
                    browser=pw.chromium.launch(headless=True)
                    page=browser.new_page(viewport={"width":1440,"height":1000})
                    errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
                    page.goto(m[0]);page.wait_for_timeout(4000)
                    print("UI visible:",page.locator("body").inner_text()[:5000])
                    print("UI buttons:",page.get_by_role("button").all_text_contents())
                    browser.close()
        finally:
            p.terminate()
            p.wait(timeout=30)
boot()
boot(True)
