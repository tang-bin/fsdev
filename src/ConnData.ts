import net, { Socket } from "net";
import { out, argvParser, confParser } from "@btang/node-toolbox";

export default class ConnData {
    static COUNT: number = 0;

    public ID: number = 0;
    public c2pSocket: Socket;
    public p2sSocket: Socket | undefined = undefined;
    public serverHost: string = "";
    public serverPort: number = 0;

    constructor(c2pSocket: Socket) {
        this.c2pSocket = c2pSocket;
        this.ID = ConnData.COUNT++;

        this._log(`Client == connect ==> Proxy`);

        this.c2pSocket.on("error", (err: any) => {
            this._log(`Client == Error ==> Proxy`, err);
        });

        this.c2pSocket.on("data", (data: any) => {
            this._log(`Client == Data ==> Proxy`, data);
        });

        this.c2pSocket.on("end", (data: any) => {
            this._log(`Client == End ==> Proxy`, data);
        });

        this.c2pSocket.on("close", (data: any) => {
            this._log(`Client == Close ==> Proxy`, data);
        });

        this.c2pSocket.on("lookup", (data: any) => {
            this._log(`Client == Lookup ==> Proxy`, data);
        });

        this.c2pSocket.on("ready", (data: any) => {
            this._log(`Client == Ready ==> Proxy`, data);
        });

        this.c2pSocket.on("drain", (data: any) => {
            this._log(`Client == Drain ==> Proxy`, data);
        });

        // We need only the data once, the starting packet
        this.c2pSocket.once("data", (data: any) => this._onceC2PData(data));
    }

    private _onceC2PData(data: any): void {
        const cd = this._parseData(data);
        this.serverHost = cd.host || this.serverHost;
        this.serverPort = cd.port || this.serverPort;

        this._log(`Client == Once ==> Proxy`, data);

        if (this.serverHost) {
            let debugHost: any = argvParser.get("debug");
            if (debugHost === "") debugHost = confParser.get("default_debug_server");

            const goMw = this.serverHost === debugHost;

            const host = goMw ? "localhost" : this.serverHost,
                port = goMw ? confParser.get("middleware_port") : this.serverPort;

            this.p2sSocket = net.createConnection({ host, port });

            this.p2sSocket.on("connect", () => {
                this._log(`Proxy == Connect ==> Server`);

                if (this._isTLSConnection(data)) {
                    //Send Back OK to HTTPS CONNECT Request
                    this.c2pSocket.write("HTTP/1.1 200 OK\r\n\n", "utf-8");
                } else {
                    this.p2sSocket!.write(data, "utf-8");
                }
                // Piping the sockets
                this.c2pSocket.pipe(this.p2sSocket!);
                this.p2sSocket!.pipe(this.c2pSocket);
            });

            this.p2sSocket.on("error", (err: any) => {
                this._log(`Proxy == Error ==> Server`, err);
            });

            this.p2sSocket.on("close", (hasError: boolean) => {
                console.debug("p2s socket close, has error = ", hasError);
            });

            this.p2sSocket.on("timeout", (hasError: boolean) => {
                console.debug("p2s socket timeout, has error = ", hasError);
            });
        }
    }

    private _log(str: string, data?: any): void {
        if (argvParser.has("verbal")) {
            str = `[Proxy ${this.ID}]: ${str}`;
            if (data) str += ": " + String(data);
            out.line(str);
        }
    }

    private _parseData(data: any): any {
        const dataStr: string = data?.toString() || "N/A",
            isTLS = this._isTLSConnection(data),
            connType = this._connectType(dataStr);

        let port: number = 80,
            host: string = "";

        try {
            if (isTLS) {
                // Port changed to 443, parsing the host from CONNECT
                port = 443;
                host = dataStr.split("CONNECT ")[1].split(" ")[0].split(":")[0];
            } else {
                // Parsing HOST from HTTP
                host = dataStr.split("Host: ")[1].split("\r\n")[0];
            }
        } catch (e) {
            this._log(`Data Parse Error`, e);
        }

        return { connType, host, port };
    }

    private _isTLSConnection(data: string): boolean {
        return data.indexOf("CONNECT ") === 0; // keep the ending space
    }

    private _connectType(dataStr: string): string {
        const firstLine = (dataStr || "").split("\n")[0] || "",
            type = firstLine.split(" ")[0] || "";
        return type;
    }
}
