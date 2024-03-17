import { execSync } from "child_process";
import path from "path";
import fs, { existsSync } from "fs";
import { out, cmd, confParser, argvParser } from "@btang/node-toolbox";
import { timeUtil } from "@btang/ts-toolbox";

class Workspace {
    public init(): Promise<any> {
        const wsPath = confParser.get("workspace");
        return new Promise((resolve, reject) => {
            if (existsSync(wsPath)) {
                reject(`Workspace ${wsPath} exists`);
            }

            cmd.serial([
                ["mkdir -p " + wsPath, "", "Create workspace"],
                ["git init .", wsPath, "Initialize git"],
                ["git remote add origin " + confParser.get("git_remote"), wsPath, "Add origin"],
                ["git remote add gerrit " + confParser.get("git_remote"), wsPath, "Add gerrit"],
            ])
                .then((rs) => {
                    const sparseFilePath = path.join(wsPath, ".git/info/sparse-checkout");
                    return fs.writeFileSync(sparseFilePath, "phoenix/src/java");
                })
                .then((rs) => {
                    out.line("Workspace is set");
                    out.line("Run 'git fetch --depth 1' to fetch files.");
                    resolve(true);
                })
                .catch((e: any) => {
                    out.line("Workspace init ends with error: " + e.toString());
                });
        });
    }

    public edit(): void {
        cmd.exec("code " + confParser.get("project_path"));
    }

    public update(): Promise<any> {
        if (argvParser.has("init")) {
            return this.init();
        } else if (argvParser.has("checkout")) {
            return this.checkout();
        } else {
            return Promise.resolve(true);
        }
    }

    public getBranch(str: string): string {
        str = String(str || "").trim();
        if (str) {
            if (/\d{3}/.test(str)) {
                return `releases/FCS${str[0]}_${str[1]}_${str[2]}`;
            } else return str;
        } else return "";
    }

    public checkout(): Promise<any> {
        const co = argvParser.getMultiple("checkout"),
            branch = this.getBranch(co ? co[0] : ""),
            name = co ? co[1] : "";
        if (branch) {
            const startTime: number = new Date().getTime();

            out.header([
                `Checkout`,
                `From: [cyan]${branch}[/cyan]`,
                `Rename: [yellow]${name}[/yellow]`,
                `To: [cyan]${confParser.get("workspace")}[/cyan]`,
            ]);

            if (this.wsChanged()) {
                if (confParser.get("auto_stash")) {
                    const stash = execSync(`git stash save`, {
                        cwd: confParser.get("project_path"),
                    });
                    out.line(stash.toString());
                } else {
                    return new Promise((resolve, reject) => {
                        reject(`Branch "${branch}" has changes, checkout aborted`);
                    });
                }
            }

            const cwd = confParser.get("project_path"),
                cmds = [
                    [`git checkout ${branch}`, cwd, "Checkout " + branch],
                    [`git pull`, cwd, "Pull files"],
                    [`git rebase`, cwd, "Rebase workspace"],
                ];

            if (argvParser.has("install")) {
                cmds.push([`npm install`, cwd, "Install modules"]);
            }

            return cmd
                .serial(cmds)
                .then(() => {
                    this.deleteBranches(branch);
                    if (name && name !== branch) {
                        return cmd.exec(`git checkout -b ${name}`, cwd, `Create local copy`);
                    } else return null;
                })
                .then((result) => {
                    if (result) {
                        this.deleteBranches(name);
                    }
                    const dur = timeUtil.formatDuring(new Date().getTime() - startTime);
                    out.line(`Done in [green]${dur}[/green]`);
                    return true;
                });
        } else {
            return new Promise((resolve, reject) => {
                reject(`Checkout branch "${branch}" error.`);
            });
        }
    }

    public deleteBranches(except?: string): void {
        const branchList = execSync("git branch", {
            cwd: confParser.get("project_path"),
        });
        branchList
            .toString()
            .split("\n")
            .forEach((branchName) => {
                branchName = branchName.replaceAll("*", "").replace(/\s/g, "").trim();
                if (branchName && (!except || branchName !== except)) {
                    const delRs = execSync("git branch -D " + branchName, {
                        cwd: confParser.get("project_path"),
                    });
                    out.line(delRs.toString(), false, false);
                }
            });
    }

    public wsChanged(): boolean {
        const status = execSync(`git status --porcelain`, {
            cwd: confParser.get("workspace"),
        });
        return !!status.toString().trim();
    }

    private _isValidWorkspace(wsPath: string): boolean {
        if (existsSync(wsPath)) {
            const exec = execSync("git config remote.gerrit.url", {
                    cwd: wsPath,
                }),
                checkURL = exec.toString().replace(/\s/g, "");
            return checkURL === confParser.get("git_remote");
        } else {
            return false;
        }
    }
}

const ws = new Workspace();
export default ws;
