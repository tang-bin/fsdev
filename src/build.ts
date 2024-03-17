import remote from "./Remote";
import { timeUtil } from "@btang/ts-toolbox";
import { pathUtil, out, cmd, argvParser, confParser } from "@btang/node-toolbox";

class Build {
    public run(): Promise<any> {
        const dp = (p: string) => pathUtil.displayPath(p);

        if (argvParser.has("build")) {
            const buildStartTime = new Date().getTime(),
                ws = confParser.get("workspace"),
                cwd = confParser.get("project_path"),
                outputPath = pathUtil.safePath(confParser.get("full_output_dir"));

            // start build.
            out.header(["Build", `From: [cyan]${dp(ws)}[/cyan]`, `Local output: [cyan]${dp(outputPath)}[/cyan]`]);

            return cmd
                .serial([
                    ["npm run build-clean", cwd, "Cleaning dist folders"],
                    ["npx gulp sync-link", cwd, "Building dev edition via gulp"],
                    ["npm run build", cwd, "Building dev edition via webpack"],
                    [`rm -rf ${outputPath}`, cwd, "Cleaning output folders"],
                    [`mkdir -p ${outputPath}`, cwd, "Creating output folders"],
                    [`cp -r ${confParser.get("js_output_dir")}/ ${outputPath}`, cwd, "Copy Javascript file"],
                    [`cp -r ${confParser.get("ts_output_dir")}/ ${outputPath}`, cwd, "Copy Typescript file"],
                ])
                .then(() => {
                    const dur = timeUtil.formatDuring(new Date().getTime() - buildStartTime);

                    out.line(`Build completed in [green]${dur}[/green]`, false, true);

                    return this._patchHosts();
                });
        } else if (argvParser.has("patch")) {
            return this._patchHosts();
        } else {
            return Promise.resolve(true);
        }
    }

    /**
     *
     * @returns Promise. Value = true => no error in the process.
     */
    private _patchHosts(): Promise<boolean> {
        const patchHosts = argvParser.getMultiple("patch");
        if (patchHosts?.length) {
            const passwd = argvParser.has("passwd") ? argvParser.get("passwd") : "",
                outputPath = pathUtil.safePath(confParser.get("full_output_dir")!);

            return Promise.all(patchHosts.map((host) => remote.patchHTML(`${outputPath}`, host, passwd))).then(
                (patchedHost: string[]) => {
                    // patchedHost: a list of patched hosts.
                    return true;
                }
            );
        } else {
            return Promise.resolve(true);
        }
    }
}

const build = new Build();
export default build;
