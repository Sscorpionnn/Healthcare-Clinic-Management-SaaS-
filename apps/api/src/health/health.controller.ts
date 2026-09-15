import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { SkipAudit } from "../common/decorators/audit-resource.decorator";
import { SkipCsrf } from "../common/decorators/skip-csrf.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @SkipCsrf()
  @SkipAudit()
  @Get()
  check() {
    return { status: "ok" };
  }
}
