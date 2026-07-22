import { fileURLToPath } from "node:url";
import { expect,it } from "vitest";
import { TRANSPARENT_BASELINE_MODEL,sexagenary } from "@senfate/core";
import { compileReferenceCorpus } from "./node";
import { ReferenceCalculationRuntime } from "./runtime";

it("audits the complete resolved topic program",()=>{
  const corpusPath=fileURLToPath(new URL("../../../data/classical-rules/classical-source-corpus.v4.0.json.gz",import.meta.url));
  const audit=compileReferenceCorpus(corpusPath);const executable=audit.records.filter(record=>record.disposition==="executable");
  const topicRules=executable.reduce((sum,record)=>sum+record.effects.reduce((effectSum,effect)=>effectSum+effect.domains.length,0),0);
  const result=new ReferenceCalculationRuntime(audit.records,TRANSPARENT_BASELINE_MODEL).calculate({natal:{year:sexagenary(16),month:sexagenary(14),day:sexagenary(34),hour:sexagenary(54)},luck:sexagenary(20),annual:sexagenary(42),sex:"male",luckDirection:"forward"});
  expect(result.ok).toBe(true);if(!result.ok)return;const certificate=result.value.topicCertificate;
  expect(certificate.program).toEqual({total:37_231,executable:4_118,deferred:7_785,contested:41,evidence:22_107,fixture:3_180});
  expect(certificate.activated+certificate.inactive+certificate.unresolved).toBe(certificate.evaluated);
  console.info(JSON.stringify({schema:"senfate-resolved-topic-feature-audit.v1",topicFunctions:executable.length,topicRules,deferred:audit.counts.deferred,contested:audit.counts.contested,canonicalFixture:{evaluated:certificate.evaluated,activated:certificate.activated,inactive:certificate.inactive,unresolved:certificate.unresolved,eventHypotheses:certificate.eventHypotheses.length,contribution:certificate.contribution.atoms}},null,2));
});
