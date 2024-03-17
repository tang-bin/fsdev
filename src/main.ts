import path from "path";
import { cmd, argvParser, confParser, out, pathUtil } from "@btang/node-toolbox";
import ws from "./Workspace";
import build from "./build";
import proxyServer from "./proxyServer";
import middlewareServer from "./middlewareServer";

argvParser.parse(process.argv);
confParser.load(["./config.json", "~/fb-config.json"], argvParser.cwd);
cmd.verbal = argvParser.has("verbal");

confParser
    .updateConf("js_output_dir", (v: string) => path.join("/tmp", pathUtil.regularPath(v)))
    .updateConf("ts_output_dir", (v: string) => path.join("/tmp", pathUtil.regularPath(v)))
    .updateConf("workspace_root", (v: string) => pathUtil.regularPath(v))
    .updateConf("full_output_dir", (v: string) => path.join(confParser.get("workspace_root"), pathUtil.regularPath(v)))
    .updateConf("git_remote", () => `ssh://${confParser.get("user_name")}@${confParser.get("remote_url")}`)
    .updateConf("server_html_root", () => path.join(confParser.get("server_www_root"), "html"))
    .updateConf("cert_file", (v: string) => pathUtil.regularPath(v, argvParser.cwd))
    .updateConf("key_file", (v: string) => pathUtil.regularPath(v, argvParser.cwd))
    .updateConf("workspace", () => {
        let cwd = String(process.cwd() || "").trim(),
            root = confParser.get("workspace_root"),
            num = 1;
        if (cwd.indexOf(root) === 0) {
            cwd = cwd.slice(root.length);
            if (cwd[0] === "/") {
                cwd = cwd.slice(1);
            }
            num = Number(cwd.split("/")[0].replace("workspace_", ""));
        }
        return path.join(confParser.get("workspace_root"), "workspace_" + (num || 1));
    })
    .updateConf("project_path", () => path.join(confParser.get("workspace"), confParser.get("h5_path")));

if (argvParser.has("edit")) {
    ws.edit();
}

if (argvParser.has("test")) {
    cmd.exec("ls", "", "test").then((rs) => console.debug(rs));
}

if (argvParser.has("help")) {
    out.ruler();
    out.line("Usage:");
    out.ruler();
    out.empty();
    out.line("TBD");
}

ws.update()
    .then((goNext) => (goNext ? build.run() : null))
    .then((goNext) => (goNext ? _debug() : null))
    .catch((e) => {
        out.line("[red]FS Error:[/red] " + String(e));
    });

function _debug(): Promise<any> {
    let debugHost: any = argvParser.get("debug");
    if (debugHost === "") debugHost = confParser.get("default_debug_server");
    if (debugHost) {
        out.header([
            "Debug Server",
            `Target: [yellow]${debugHost}[/yellow]`,
            `Proxy on [cyan]${confParser.get("proxy_port")}[/cyan]`,
            `Middleware on [cyan]${confParser.get("middleware_port")}[/cyan]`,
        ]);

        return Promise.all([proxyServer.start(), middlewareServer.start()]).then(([proxyStatus, mwStatus]) => {
            if (proxyStatus) out.success("Proxy server started");
            else out.failed("Start proxy server failed");
            if (mwStatus) out.success("Middleware server started");
            else out.failed("Start middleware server failed");

            return proxyStatus && mwStatus;
        });
    } else {
        return Promise.resolve(false);
    }
}
