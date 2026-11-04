import { describe, expect, it } from 'vitest'
import { checkSmart } from '../src/lib/grade'
import { gradeLearnAnswer } from '../src/lib/learn'

describe('local smart grading', () => {
  it.each([
    ['Regulates what enters and leaves a cell', 'Controls what enters and leaves the cell'],
    ['The fundamental building block of living things', 'The basic unit of life'],
    ['Makes proteins', 'Produces proteins'],
    ['Transforms light energy into chemical energy', 'Converts light energy into chemical energy'],
    ['Proteins are made by ribosomes', 'Ribosomes produce proteins'],
    ['Glucose, oxygen and water', 'Water, glucose and oxygen'],
    ['Two water molecules', '2 molecules of water'],
    ['1/2', '0.5'],
    ['50 percent', '0.5'],
    ["Doesn't store energy", 'Does not store energy'],
    ['50%', 'one half'],
  ])('accepts %s for %s', (given, expected) => expect(checkSmart(given, expected)).not.toBe('wrong'))

  it.each([
    ['Releases energy', 'Does not release energy'],
    ['Does not release energy', 'Releases energy'],
    ['Never contains DNA', 'Contains DNA'],
    ['Produces RNA', 'Produces DNA'],
    ['Controls what leaves a cell', 'Controls what enters and leaves a cell'],
    ['Decreases blood pressure', 'Increases blood pressure'],
    ['Cats chase dogs', 'Dogs chase cats'],
    ['Earth warms the sun', 'The sun warms Earth'],
    ['Erosion causes water', 'Water causes erosion'],
    ['Oxygen moves from blood to lungs', 'Oxygen moves from lungs to blood'],
    ['4 molecules of water', '2 molecules of water'],
    ['0.6', '1/2'],
    ['Na-', 'Na+'],
    ['2 + 2', '4'],
    ['A proton (3)', 'A proton (2)'],
    ['', 'answer'],
    ['A completely unrelated sentence', 'The basic unit of life'],
  ])('rejects %s for %s', (given, expected) => expect(checkSmart(given, expected)).toBe('wrong'))

  it('keeps strict spelling for mastery even with smart grading enabled', () => {
    expect(gradeLearnAnswer('Makes proteins', 'Produces proteins', 'understanding', true)).toBe('equivalent')
    expect(gradeLearnAnswer('Makes proteins', 'Produces proteins', 'mastery', true)).toBe('wrong')
  })
})
