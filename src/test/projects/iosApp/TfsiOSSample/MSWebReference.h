// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import <Foundation/Foundation.h>

@interface MSWebReference : NSObject

@property (strong, nonatomic) NSString *resourceName;
@property (retain, nonatomic) NSURL *resourceURL;

// convenience constructor for strings
- (id)initWithName:(NSString*)name URL: (NSString*)urlString;
- (NSString*)description;
@end
