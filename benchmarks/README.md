# AI Platform Benchmark Suite

Measures the accuracy of the platform's multi-agent analysis against known codebases with pre-labeled findings.

## How It Works

1. Each benchmark case is a known codebase with **expected findings** (ground truth)
2. The platform runs analysis (with debate) against the codebase
3. Results are compared: true positives, false positives, false negatives, true negatives
4. Metrics: precision, recall, F1 score, false positive rate

## Metrics Definitions

- **True Positive (TP)**: Platform found a real issue that exists in ground truth
- **False Positive (FP)**: Platform reported an issue that doesn't exist (noise)
- **False Negative (FN)**: Platform missed a real issue that's in ground truth
- **Precision**: TP / (TP + FP) -- "of what we reported, how much was real?"
- **Recall**: TP / (TP + FN) -- "of real issues, how many did we find?"
- **F1 Score**: Harmonic mean of precision and recall
- **False Positive Rate**: FP / (FP + TN)

## Running Benchmarks

```bash
npx tsx benchmarks/run-benchmarks.ts
```
