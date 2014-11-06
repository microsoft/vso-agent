// A simple program that computes the square root of a number
#include <stdio.h> 
#include <stdlib.h>   // atof
#include <math.h>     // sqrt
#include "sqrt.h"

int main (int argc, char *argv[])
{
  if (argc < 2) {
	fprintf(stdout,"%s Version %d.%d\n",
            argv[0],
            sqrt_VERSION_MAJOR,
            sqrt_VERSION_MINOR);

    fprintf(stdout,"Usage: %s number\n",argv[0]);
    return 1;
  }

  double inputValue = atof(argv[1]);
  double outputValue = sqrt(inputValue);
  fprintf(stdout,"The square root of %g is %g\n",
          inputValue, outputValue);

  return 0;
}