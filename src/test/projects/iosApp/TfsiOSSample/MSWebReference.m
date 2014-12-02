// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import "MSWebReference.h"

@implementation MSWebReference

@synthesize resourceName;
@synthesize resourceURL;

// convenience constructor for strings
- (id)initWithName:(NSString*)name URL: (NSString*)urlString
{
    self = [super init];
    if (self)
    {
        [self setResourceName:name];
        [self setResourceURL: [NSURL URLWithString:urlString]];
    }
    
    return self;
}

- (NSString*)description
{
    return [[[self resourceName] copy] autorelease];
}

@end
