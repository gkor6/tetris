const random = (fromInclusive, toInclusive) => Math.floor(fromInclusive + Math.random() * (toInclusive + 1 - fromInclusive));

export { random };