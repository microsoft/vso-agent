// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import <Foundation/Foundation.h>
#import "MSWebReference.h"

@interface MSWebReferenceModel : NSObject

@property (nonatomic) NSInteger selectedIndex;

- (NSInteger)count;
- (MSWebReference*)webReferenceAtIndex: (NSInteger)index;

- (void)setSelectedIndex: (NSInteger)index;
- (void)addWebReference:(MSWebReference*)webReference;
- (void)addWebReferenceNamed: (NSString*)name withURLString:(NSString*)string;

@end
