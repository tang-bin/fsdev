import net, { Socket } from "net";
import ConnData from "./ConnData";
import { confParser, out } from "@btang/node-toolbox";

class ProxyServer {
    private _proxyServer: net.Server = net.createServer();
    private connections: ConnData[] = [];

    constructor() {}

    public start(): Promise<any> {
        return new Promise((resolve, reject) => {
            this._proxyServer.on("error", (err: any) => {
                out.error("Proxy Server Error");
                reject(err);
            });

            this._proxyServer.on("close", () => {
                out.warning("Proxy Server Closed");
                reject();
            });

            this._proxyServer.on("connection", (socket: Socket) => {
                this.connections.push(new ConnData(socket));
            });

            const port = Number(confParser.get("proxy_port"));
            this._proxyServer.listen(port, () => resolve(true));
        });
    }
}

const proxyServer = new ProxyServer();
export default proxyServer;
