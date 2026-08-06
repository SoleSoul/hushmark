---
title: Mathematics visual inspection
audience: Hushmark reader QA
topics:
  - Markdown math
  - layout
  - printing
---
# Mathematics visual inspection

This document checks inline and display mathematics across ordinary reading, narrow windows, zoom, layout changes, and printing.

## Inline mathematics

Einstein's relation $E = mc^2$ should sit naturally on the text baseline. The identity $e^{i\pi} + 1 = 0$ should remain legible without changing the surrounding line height abruptly.

Subscripts, roots, fractions, and Greek letters should remain clear: $a_n = \sqrt{\frac{\alpha + \beta}{n}}$.

Ordinary prices should remain ordinary text: a notebook costs $5.00 and a pen costs $2.00. An escaped dollar sign should also remain visible: \$12.50.

## Display mathematics

The quadratic formula should be centered and separated from the prose without looking like a panel:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

The following integral checks limits, spacing, and scalable delimiters:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

## Structured expressions

A matrix should retain balanced brackets and aligned cells:

$$
A = \begin{pmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{pmatrix}
$$

An aligned derivation should keep its relation signs in one column:

$$
\begin{aligned}
(a+b)^2 &= (a+b)(a+b) \\
        &= a^2 + 2ab + b^2
\end{aligned}
$$

## Mathematics in Markdown structures

- The area of a circle is $A = \pi r^2$.
- The derivative of $x^n$ is $n x^{n-1}$.

| Quantity | Expression |
| --- | --- |
| Mean | $\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i$ |
| Variance | $\sigma^2 = \frac{1}{n}\sum_{i=1}^{n}(x_i-\bar{x})^2$ |

## Long display overflow

At narrow widths, this deliberately long expression should scroll locally rather than widening the document:

$$
\mathcal{L}(\theta) = \sum_{i=1}^{n}\left[y_i\log\left(\frac{1}{1+e^{-\theta^T x_i}}\right) + (1-y_i)\log\left(1-\frac{1}{1+e^{-\theta^T x_i}}\right)\right] - \lambda\sum_{j=1}^{m}\theta_j^2
$$

## Invalid input

The unsupported command below should remain visible with its dollar delimiters rather than disappearing or producing HTML:

$$
\hushmarkUnsupported{<script>alert(1)</script>}
$$

This final unclosed expression should remain plain source: $x + y
