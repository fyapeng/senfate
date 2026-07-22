import{describe,expect,it}from"vitest";
import{userFacingRequestError}from"./request-error";

describe("user-facing request errors",()=>{
  it("keeps an intentional Chinese recovery message",()=>expect(userFacingRequestError(new Error("请重新选择地点。"),"服务暂时不可用")).toBe("请重新选择地点。"));
  it("hides parser and network implementation details",()=>{expect(userFacingRequestError(new SyntaxError("Unexpected token '<', HTML is not valid JSON"),"计算服务暂时不可用，请稍后重试。")).toBe("计算服务暂时不可用，请稍后重试。");expect(userFacingRequestError(new TypeError("Failed to fetch"),"地点搜索暂时不可用，请稍后重试。")).toBe("地点搜索暂时不可用，请稍后重试。");});
});
