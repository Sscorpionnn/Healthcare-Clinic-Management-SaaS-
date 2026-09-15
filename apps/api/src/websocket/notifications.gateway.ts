import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { parse as parseCookies } from "cookie";
import { ACCESS_TOKEN_COOKIE } from "../common/constants";
import { TokenService } from "../auth/token.service";

/**
 * Cookie-authenticated WebSocket namespace for live notification delivery.
 * Room membership is server-assigned from the verified token only — a
 * client never chooses its own room name, so it can never subscribe to
 * another tenant's or another user's channel. See docs/api-contract.md,
 * WebSocket, and docs/threat-model.md T18.
 */
@WebSocketGateway({ namespace: "/ws", cors: false })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly tokens: TokenService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) throw new Error("no cookies");
      const cookies = parseCookies(cookieHeader);
      const accessToken = cookies[ACCESS_TOKEN_COOKIE];
      if (!accessToken) throw new Error("no access token");

      const payload = await this.tokens.verifyAccessToken(accessToken);
      if (payload.isSuperAdmin || !payload.clinicId) {
        client.disconnect(true);
        return;
      }

      const room = `clinic:${payload.clinicId}:user:${payload.sub}`;
      await client.join(room);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`socket disconnected: ${client.id}`);
  }

  /** Called by the notifications service after creating a Notification row — never by client input. */
  emitNotification(
    clinicId: string,
    userId: string,
    payload: { id: string; title: string; type: string },
  ): void {
    this.server
      .to(`clinic:${clinicId}:user:${userId}`)
      .emit("notification", payload);
  }
}
