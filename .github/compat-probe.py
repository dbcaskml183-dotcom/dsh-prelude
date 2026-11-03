import http.cookiejar, json, os, pathlib, re, shutil, subprocess, tempfile, time, urllib.request
home=pathlib.Path(os.environ["DSH_HOME"])
if os.environ.get("BROWSER")=="1": pathlib.Path.home().joinpath("prelude-test-workspace").mkdir(parents=True,exist_ok=True)
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
                    page.get_by_role("button",name="Continue",exact=True).wait_for(state="visible",timeout=15000)
                    page.get_by_role("button",name="Continue",exact=True).click()
                    page.get_by_role("button",name="Add API Key",exact=True).wait_for(state="visible",timeout=15000)
                    page.keyboard.press("Escape")
                    page.get_by_role("button",name="Choose workspace",exact=True).click()
                    page.get_by_role("button",name="prelude-test-workspace",exact=True).dblclick()
                    page.get_by_role("button",name="Open",exact=True).click()
                    page.locator('[contenteditable="true"]').fill("用 Python 标准库把 CSV 转成 JSON，保留原文件。")
                    page.get_by_role("button",name="Prelude",exact=True).click()
                    page.wait_for_timeout(1000)
                    page.get_by_role("button",name="方法库 · 90",exact=True).click()
                    page.get_by_role("textbox",name="搜索方法",exact=True).fill("验收标准")
                    card=page.locator('[data-method="acceptance"]')
                    card.wait_for(state="visible")
                    page.get_by_role("button",name="插入光标处：验收标准",exact=True).click()
                    draft=page.locator('[contenteditable="true"]').inner_text()
                    assert "用 Python 标准库把 CSV 转成 JSON，保留原文件。" in draft
                    assert "请明确可核对的完成标准" in draft
                    assert not errors,errors
                    page.screenshot(path=str(home/"compat-ui.png"),full_page=True)
                    print(json.dumps({"browserFlow":"open-search-insert","draftPreserved":True,"snippetInserted":True,"pageErrors":errors,"modelCalls":0},ensure_ascii=False))
                    browser.close()
        finally:
            p.terminate()
            p.wait(timeout=30)
boot()
boot(True)
