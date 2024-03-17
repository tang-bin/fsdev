import { NodeSSH } from "node-ssh";
import { out, pathUtil, confParser } from "@btang/node-toolbox";
import { timeUtil } from "@btang/ts-toolbox";

class Remote {
    static DEFAULT_PASSWD: string = "Fortinet*11";

    public chownHTML(host: string, passwd?: string): Promise<any> {
        out.line(`Change "html" owner to "admin" on "${host}".`, true);
        return this._connectTo(host, passwd).then((ssh) => {
            return ssh
                .exec("chown", ["-R", "admin:admin", "html"], {
                    cwd: confParser.get("server_www_root"),
                    stream: "stdout",
                })
                .then(() => {
                    ssh.dispose();
                    return true;
                });
        });
    }

    /**
     *
     * @param localDir
     * @param host
     * @param passwd
     * @returns Promise<string>. The patched host
     */
    public patchHTML(localDir: string, host: string, passwd?: string): Promise<string> {
        const startTime: number = new Date().getTime();

        out.header(["Patch", `From: [cyan]${pathUtil.displayPath(localDir)}[/cyan]`, `To: [yellow]${host}[/yellow]`]);

        out.line(`Uploading`, true, false);

        let successCount = 0,
            failedCount = 0,
            ssh: NodeSSH;

        return this._connectTo(host, passwd)
            .then((_ssh: NodeSSH) => {
                ssh = _ssh;
                return ssh.execCommand("rm -rf html", {
                    cwd: confParser.get("server_www_root"),
                });
            })
            .then((result: any) => {
                return ssh.putDirectory(localDir, confParser.get("server_html_root"), {
                    recursive: true,
                    concurrency: 10,
                    // ^ WARNING: Not all servers support high concurrency
                    // try a bunch of values and see what works on your server
                    // , validate(itemPath) { }
                    tick(localPath: string, remotePath: string, error: any) {
                        // console.debug(" ==> ", localPath);
                        if (error) {
                            failedCount += 1;
                            console.debug(" ===> ERROR ", error);
                        } else {
                            successCount += 1;
                        }
                        out.append(`[green]${successCount} uploaded[/green] / [red]${failedCount} failed[/red]`);
                    },
                });
            })
            .then((status: boolean) => {
                if (status) {
                    return ssh.exec("chown", ["-R", "admin:admin", "html"], {
                        cwd: confParser.get("server_www_root"),
                        stream: "stdout",
                    });
                } else return Promise.reject("Upload process failed.");
            })
            .then((result: string) => {
                // ! Guess the result is the output of the cmd.
                // ! In this case, chown has no output.
                ssh.dispose();

                const dur = timeUtil.formatDuring(new Date().getTime() - startTime);
                out.newline();
                out.line(`Done in [green]${dur}[/green]`);
                return host;
            });
    }

    private _connectTo(host: string, passwd?: string): Promise<NodeSSH> {
        const ssh = new NodeSSH();
        return ssh
            .connect({
                host,
                username: "root",
                password: passwd || confParser.get("default_passwd"),
            })
            .then(() => ssh);
    }
}

const remote = new Remote();
export default remote;
