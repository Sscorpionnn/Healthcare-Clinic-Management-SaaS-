import { Module } from "@nestjs/common";
import { DeletionRequestsController } from "./deletion-requests.controller";
import { DeletionRequestsService } from "./deletion-requests.service";
import { DeletionRequestAccessPolicy } from "./deletion-requests.policy";

@Module({
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService, DeletionRequestAccessPolicy],
})
export class DeletionRequestsModule {}
