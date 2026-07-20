import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { sitesRouter } from "./sites.routes.js";
import { workersRouter } from "./workers.routes.js";
import { pointagesRouter } from "./pointages.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(sitesRouter);
apiRouter.use(workersRouter);
apiRouter.use(pointagesRouter);
