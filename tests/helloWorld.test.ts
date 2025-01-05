import { helloWorld } from '../src';

test('prints string correctly', () => {
  const result = helloWorld("hello univerejs");
  expect(result).toBe("hello univerejs");
});