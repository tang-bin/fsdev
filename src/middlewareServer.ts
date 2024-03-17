import https from "https";
import fs from "fs";
import { IncomingMessage } from "http";
import url from "url";
import path from "path";
import { out, argvParser, confParser } from "@btang/node-toolbox";
import { timeUtil } from "@btang/ts-toolbox";

class MiddlewareServer {
    private _server: https.Server | undefined;

    private _indexReg = /^https:\/.*?\/phoenix\/html(\/(\w|\/)+)?$/gi;
    private _fileReg = /^https:\/.*?\/phoenix\/html\/(.*?)\.(js|css|html|properties)$/gi;

    constructor() {}

    public start(): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                key: fs.readFileSync(confParser.get("key_file")),
                cert: fs.readFileSync(confParser.get("cert_file")),
            };

            const port = Number(confParser.get("middleware_port"));

            this._server = https.createServer(options, (req, res) => this._onReq(req, res));
            this._server.on("error", (err: any) => reject("Middleware error: " + err));
            this._server.listen(port, () => resolve(true));
        });
    }

    private _onReq(req: IncomingMessage, res: any) {
        const verbal = argvParser.has("verbal");

        const hostName = req.headers.host,
            path = req.url,
            method = req.method,
            fullURL = `https://${hostName}${path}`;

        const localFilePath = this._findLocalFile(fullURL);
        if (verbal) out.line(`[${method}]: ${fullURL}`);

        if (localFilePath) {
            if (verbal) out.line(`  ==> ${localFilePath}`);
            this._resLocalFile(localFilePath, res, fullURL).catch((err) => {
                this._resFromServer(fullURL, req, res);
            });
        } else {
            return this._resFromServer(fullURL, req, res);
        }
    }

    private _resLocalFile(filePath: string, res: any, origURL: string): Promise<any> {
        const verbal = argvParser.has("verbal");
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, { encoding: "utf8" }, (err, data) => {
                if (err) {
                    if (verbal) console.error(err);
                    else {
                        out.empty();
                        out.line(`[red]Load Failed:[/red] ${timeUtil.formatDate("now")}`);
                        out.line(` > URL: ${origURL}`);
                        out.line(` > File: ${filePath}`);
                    }
                    reject(err);
                } else {
                    res.writeHead(200);
                    res.write(data);
                    res.end();
                    resolve(true);
                }
            });
        });
    }

    private _resFromServer(fullURL: string, req: IncomingMessage, res: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const options: any = url.parse(fullURL);
            options.method = req.method;
            options.rejectUnauthorized = false;
            options.headers = req.headers;

            const req2 = https
                .request(options, (res2) => {
                    res.writeHead(res2.statusCode, res2.statusMessage, res2.headers);

                    res2.on("data", (d) => res.write(d));
                    res2.on("end", () => {
                        res.end();
                        resolve(true);
                    });
                })
                .on("error", (e) => {
                    console.error(e);
                    reject(e);
                });

            req.on("data", (data: any) => req2.write(data));
            req.on("end", () => req2.end());
        });
    }

    private _findLocalFile(url: string): string {
        let filePath = "";

        if (this._indexReg.test(url)) filePath = "index.html";
        if (this._fileReg.test(url)) filePath = url.replace(this._fileReg, "$1.$2");
        if (filePath) filePath = path.join(confParser.get("full_output_dir"), filePath);

        return filePath;
    }
}

const middlewareServer = new MiddlewareServer();
export default middlewareServer;
