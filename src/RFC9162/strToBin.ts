const encoder = new TextEncoder()

export const strToBin = (s: string) => encoder.encode(s)
