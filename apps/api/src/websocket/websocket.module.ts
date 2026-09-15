import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsGateway } from "./notifications.gateway";

@Global()
@Module({
  imports: [AuthModule],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class WebsocketModule {}
