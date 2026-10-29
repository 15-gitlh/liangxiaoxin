export function toVectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("vector 必须是非空数组");
  }
  return `[${vector.join(",")}]`;
}

export function assertVectorDim(vector, expected, label = "embedding") {
  if (!Array.isArray(vector) || vector.length !== expected) {
    throw new Error(`${label} 维度不匹配: expected=${expected} got=${vector?.length}`);
  }
  return vector;
}
