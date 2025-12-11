// src/std/stdlib.ts
// Standard library definitions - these are built-in functions compiled to C

export const standardLibraryC = `
// Standard Library Implementation

// Math utilities
int std_abs(int n) {
  return n < 0 ? -n : n;
}

int std_max(int a, int b) {
  return a > b ? a : b;
}

int std_min(int a, int b) {
  return a < b ? a : b;
}

// String utilities  
char* std_concat(char* a, char* b) {
  char* result = malloc(strlen(a) + strlen(b) + 1);
  strcpy(result, a);
  strcat(result, b);
  return result;
}

char* std_length_str(char* s) {
  // Returns string representation of length
  char* result = malloc(20);
  sprintf(result, "%lu", strlen(s));
  return result;
}

// Array utilities
int std_array_sum(int* arr, int len) {
  int sum = 0;
  for (int i = 0; i < len; i++) {
    sum += arr[i];
  }
  return sum;
}

int std_array_max(int* arr, int len) {
  if (len == 0) return 0;
  int max = arr[0];
  for (int i = 1; i < len; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

int std_array_min(int* arr, int len) {
  if (len == 0) return 0;
  int min = arr[0];
  for (int i = 1; i < len; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}
`;
