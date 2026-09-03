import { Router } from "express";
import { runComparison } from "../lib/benchmarkApiVsDb";

const router = Router();

router.get("/api/benchmark", async (req, res) => {
  const result = await runComparison();
  res.json(result);
});

export default router;
