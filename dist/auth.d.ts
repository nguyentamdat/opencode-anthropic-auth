export declare function authorize(mode: 'max' | 'console'): Promise<{
    url: string;
    verifier: string;
}>;
export type ExchangeResult = {
    type: 'success';
    refresh: string;
    access: string;
    expires: number;
} | {
    type: 'failed';
};
export declare function exchange(code: string, verifier: string): Promise<ExchangeResult>;
