import{describe,expect,it}from"vitest";
import{formatCoordinateUncertainty,validateExactCoordinates}from"./coordinates";

describe("exact coordinate input",()=>{
  it("omits the override when disabled",()=>expect(validateExactCoordinates({enabled:false,latitude:"",longitude:"",uncertaintyMeters:""})).toEqual({valid:true}));
  it("returns a bounded coordinate override",()=>expect(validateExactCoordinates({enabled:true,latitude:"39.9042",longitude:"116.4074",uncertaintyMeters:"30"})).toEqual({valid:true,value:{latitude:39.9042,longitude:116.4074,uncertaintyMeters:30}}));
  it("fails closed for missing or out-of-range values",()=>{expect(validateExactCoordinates({enabled:true,latitude:"",longitude:"116",uncertaintyMeters:"30"})).toMatchObject({valid:false});expect(validateExactCoordinates({enabled:true,latitude:"91",longitude:"116",uncertaintyMeters:"30"})).toMatchObject({valid:false});expect(validateExactCoordinates({enabled:true,latitude:"39",longitude:"181",uncertaintyMeters:"30"})).toMatchObject({valid:false});expect(validateExactCoordinates({enabled:true,latitude:"39",longitude:"116",uncertaintyMeters:"-1"})).toMatchObject({valid:false})});
  it("keeps sub-kilometer uncertainty visible",()=>{expect(formatCoordinateUncertainty(30)).toBe("±30 米");expect(formatCoordinateUncertainty(1500)).toBe("±1.5 公里")});
});
