declare module "kuromoji" {
  export interface IpadicFeatures {
    surface_form: string;
    reading?: string;
  }
  export interface Tokenizer<T> {
    tokenize(text: string): T[];
  }
  const kuromoji: {
    builder(o: { dicPath: string }): { build(cb: (err: Error | null, t: Tokenizer<IpadicFeatures>) => void): void };
  };
  export default kuromoji;
}
